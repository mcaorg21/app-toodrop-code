import { useState, useEffect } from "react";
import { useApi } from "@/react-app/hooks/useApi";
import { X, Loader2, Clock } from "lucide-react";
import { useTranslation } from "@/react-app/i18n";

interface ScheduleModalProps {
  onClose: () => void;
}

const DAY_KEYS = [
  { id: 0, key: "sunday" },
  { id: 1, key: "monday" },
  { id: 2, key: "tuesday" },
  { id: 3, key: "wednesday" },
  { id: 4, key: "thursday" },
  { id: 5, key: "friday" },
  { id: 6, key: "saturday" },
];

export function ScheduleModal({ onClose }: ScheduleModalProps) {
  const { t } = useTranslation();
  const { fetchSchedule, updateSchedule, isLoading, error } = useApi();
  const [schedules, setSchedules] = useState<Array<{
    day_of_week: number;
    range1_start: string | null;
    range1_end: string | null;
    range2_start: string | null;
    range2_end: string | null;
    is_active: boolean;
  }>>(
    DAY_KEYS.map(day => ({
      day_of_week: day.id,
      range1_start: null,
      range1_end: null,
      range2_start: null,
      range2_end: null,
      is_active: false,
    }))
  );

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    const data = await fetchSchedule();
    if (data.length > 0) {
      const scheduleMap = new Map(data.map(s => [s.day_of_week, s]));
      setSchedules(DAY_KEYS.map(day => {
        const existing = scheduleMap.get(day.id);
        return existing ? {
          day_of_week: day.id,
          range1_start: existing.range1_start,
          range1_end: existing.range1_end,
          range2_start: existing.range2_start,
          range2_end: existing.range2_end,
          is_active: existing.is_active === 1,
        } : {
          day_of_week: day.id,
          range1_start: null,
          range1_end: null,
          range2_start: null,
          range2_end: null,
          is_active: false,
        };
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await updateSchedule({ schedules });
    if (result) {
      onClose();
    }
  };

  const toggleDay = (dayIndex: number) => {
    setSchedules(prev => prev.map((s, i) => 
      i === dayIndex ? { ...s, is_active: !s.is_active } : s
    ));
  };

  const updateScheduleTime = (dayIndex: number, field: string, value: string) => {
    setSchedules(prev => prev.map((s, i) => 
      i === dayIndex ? { ...s, [field]: value || null } : s
    ));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[300] backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-strong w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-100 p-6 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-3 tracking-tight">
            <Clock className="w-7 h-7 text-neutral-700" strokeWidth={2} />
            {t("schedule.title")}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {DAY_KEYS.map((day, index) => {
              const schedule = schedules[index];
              return (
                <div key={day.id} className="border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedule.is_active}
                        onChange={() => toggleDay(index)}
                        className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="font-semibold text-neutral-900">{t(`schedule.days.${day.key}`)}</span>
                    </label>
                  </div>

                  {schedule.is_active && (
                    <div className="space-y-4 pl-8">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                            {t("schedule.period1Start")}
                          </label>
                          <input
                            type="time"
                            value={schedule.range1_start || ""}
                            onChange={(e) => updateScheduleTime(index, "range1_start", e.target.value)}
                            className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                            {t("schedule.period1End")}
                          </label>
                          <input
                            type="time"
                            value={schedule.range1_end || ""}
                            onChange={(e) => updateScheduleTime(index, "range1_end", e.target.value)}
                            className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                            {t("schedule.period2Start")}
                          </label>
                          <input
                            type="time"
                            value={schedule.range2_start || ""}
                            onChange={(e) => updateScheduleTime(index, "range2_start", e.target.value)}
                            className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                            {t("schedule.period2End")}
                          </label>
                          <input
                            type="time"
                            value={schedule.range2_end || ""}
                            onChange={(e) => updateScheduleTime(index, "range2_end", e.target.value)}
                            className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm active:scale-95 mt-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                  {t("schedule.saving")}
                </>
              ) : (
                t("schedule.save")
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
