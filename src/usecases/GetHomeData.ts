import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
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
  date: string;
  /** IANA timezone (ex: America/Sao_Paulo). Se não enviado, usa UTC. */
  timezone?: string;
}

interface OutputDto {
  activeWorkoutPlanId?: string;
  todayWorkoutDay?: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercisesCount: number;
  };
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
}

export class GetHomeData {
  async execute(dto: InputDto): Promise<OutputDto> {
    let tz = dto.timezone ?? "UTC";
    let currentDate: dayjs.Dayjs;
    try {
      currentDate =
        tz === "UTC"
          ? dayjs.utc(dto.date)
          : dayjs.tz(dto.date, tz);
      if (!currentDate.isValid()) {
        tz = "UTC";
        currentDate = dayjs.utc(dto.date);
      }
    } catch {
      tz = "UTC";
      currentDate = dayjs.utc(dto.date);
    }

    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: {
        workoutDays: {
          include: {
            exercises: true,
            sessions: true,
          },
        },
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const todayWeekDay = WEEKDAY_MAP[currentDate.day()];
    const todayWorkoutDay = workoutPlan?.workoutDays.find(
      (day) => day.weekDay === todayWeekDay
    );

    // Semana segunda–domingo (igual ao ConsistencyTracker no frontend)
    const weekStart = currentDate.day(1).startOf("day");
    const weekEnd = weekStart.add(6, "day").endOf("day");

    const weekSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: workoutPlan?.id,
        },
        startedAt: {
          gte: weekStart.toDate(),
          lte: weekEnd.toDate(),
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

    for (let i = 0; i < 7; i++) {
      const day = weekStart.add(i, "day");
      const dateKey = day.format("YYYY-MM-DD");

      const daySessions = weekSessions.filter(
        (s) => sessionDateKey(s.startedAt) === dateKey
      );

      const workoutDayStarted = daySessions.length > 0;
      const workoutDayCompleted = daySessions.some(
        (s) => s.completedAt !== null
      );

      consistencyByDay[dateKey] = { workoutDayCompleted, workoutDayStarted };
    }

    let workoutStreak = 0;

    if (workoutPlan) {
      workoutStreak = await this.calculateStreak(
        workoutPlan.id,
        workoutPlan.workoutDays,
        currentDate,
        tz
      );
    }

    return {
      activeWorkoutPlanId: workoutPlan.id,
      todayWorkoutDay:
        todayWorkoutDay && workoutPlan
          ? {
              workoutPlanId: workoutPlan.id,
              id: todayWorkoutDay.id,
              name: todayWorkoutDay.name,
              isRest: todayWorkoutDay.isRest,
              weekDay: todayWorkoutDay.weekDay,
              estimatedDurationInSeconds:
                todayWorkoutDay.estimatedDurationInSeconds,
              coverImageUrl: todayWorkoutDay.coverImageUrl ?? undefined,
              exercisesCount: todayWorkoutDay.exercises.length,
            }
          : undefined,
      workoutStreak,
      consistencyByDay,
    };
  }

  /**
   * Streak = quantidade de dias consecutivos (de hoje para trás) em que
   * há treino completado. Dias de descanso não entram na contagem.
   */
  private async calculateStreak(
    workoutPlanId: string,
    workoutDays: Array<{
      weekDay: string;
      isRest: boolean;
      sessions: Array<{ startedAt: Date; completedAt: Date | null }>;
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