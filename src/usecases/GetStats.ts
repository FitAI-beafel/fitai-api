import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEKDAY_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

interface InputDto {
  userId: string;
  from: string;
  to: string;
  /** IANA timezone (ex: America/Sao_Paulo). Se não enviado, usa UTC. */
  timezone?: string;
}

interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    let tz = dto.timezone ?? "UTC";
    let fromDate: dayjs.Dayjs;
    let toDate: dayjs.Dayjs;
    try {
      if (tz === "UTC") {
        fromDate = dayjs.utc(dto.from).startOf("day");
        toDate = dayjs.utc(dto.to).endOf("day");
      } else {
        fromDate = dayjs.tz(dto.from, tz).startOf("day");
        toDate = dayjs.tz(dto.to, tz).endOf("day");
      }
      if (!fromDate.isValid() || !toDate.isValid()) {
        tz = "UTC";
        fromDate = dayjs.utc(dto.from).startOf("day");
        toDate = dayjs.utc(dto.to).endOf("day");
      }
    } catch {
      tz = "UTC";
      fromDate = dayjs.utc(dto.from).startOf("day");
      toDate = dayjs.utc(dto.to).endOf("day");
    }

    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: {
        workoutDays: {
          include: { sessions: true },
        },
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: workoutPlan.id,
        },
        startedAt: {
          gte: fromDate.toDate(),
          lte: toDate.toDate(),
        },
      },
    });

    const sessionDateKey = (startedAt: Date) =>
      tz === "UTC"
        ? dayjs.utc(startedAt).format("YYYY-MM-DD")
        : dayjs.utc(startedAt).tz(tz).format("YYYY-MM-DD");

    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    sessions.forEach((session) => {
      const dateKey = sessionDateKey(session.startedAt);

      if (!consistencyByDay[dateKey]) {
        consistencyByDay[dateKey] = {
          workoutDayCompleted: false,
          workoutDayStarted: false,
        };
      }

      consistencyByDay[dateKey].workoutDayStarted = true;

      if (session.completedAt !== null) {
        consistencyByDay[dateKey].workoutDayCompleted = true;
      }
    });

    const completedSessions = sessions.filter((s) => s.completedAt !== null);
    const completedWorkoutsCount = completedSessions.length;
    const conclusionRate =
      sessions.length > 0 ? completedWorkoutsCount / sessions.length : 0;

    const totalTimeInSeconds = completedSessions.reduce((total, session) => {
      const start = dayjs.utc(session.startedAt);
      const end = dayjs.utc(session.completedAt!);
      return total + end.diff(start, "second");
    }, 0);

    const workoutStreak = await this.calculateStreak(
      workoutPlan.id,
      workoutPlan.workoutDays,
      toDate,
      tz
    );

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }

  private async calculateStreak(
    workoutPlanId: string,
    workoutDays: Array<{
      weekDay: string;
      isRest: boolean;
    }>,
    currentDate: dayjs.Dayjs,
    tz: string
  ): Promise<number> {
    const planWeekDays = new Set(workoutDays.map((d) => d.weekDay));
    const restWeekDays = new Set(
      workoutDays.filter((d) => d.isRest).map((d) => d.weekDay)
    );

    const allSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: { workoutPlanId },
        completedAt: { not: null },
      },
      select: { startedAt: true },
    });

    const sessionDateKey = (startedAt: Date) =>
      tz === "UTC"
        ? dayjs.utc(startedAt).format("YYYY-MM-DD")
        : dayjs.utc(startedAt).tz(tz).format("YYYY-MM-DD");

    const completedDates = new Set(
      allSessions.map((s) => sessionDateKey(s.startedAt))
    );

    let streak = 0;
    let day = currentDate;

    for (let i = 0; i < 365; i++) {
      const weekDay = WEEKDAY_MAP[day.day()];

      if (!planWeekDays.has(weekDay)) {
        day = day.subtract(1, "day");
        continue;
      }

      if (restWeekDays.has(weekDay)) {
        day = day.subtract(1, "day");
        continue;
      }

      const dateKey = day.format("YYYY-MM-DD");
      if (completedDates.has(dateKey)) {
        streak++;
        day = day.subtract(1, "day");
        continue;
      }

      break;
    }

    return streak;
  }
}
