package rw.ac.auca.leave_request.service;

import java.time.DayOfWeek;
import java.time.LocalDate;

/** Counting working days: Monday to Friday. Public holidays are not taken off. */
public final class WorkingDays {

    private WorkingDays() {
    }

    /** Working days from {@code start} to {@code end}, both counted, limited to the calendar {@code year}. */
    public static int inYear(LocalDate start, LocalDate end, int year) {
        LocalDate from = start.isBefore(LocalDate.of(year, 1, 1)) ? LocalDate.of(year, 1, 1) : start;
        LocalDate to = end.isAfter(LocalDate.of(year, 12, 31)) ? LocalDate.of(year, 12, 31) : end;
        int days = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            DayOfWeek weekday = day.getDayOfWeek();
            if (weekday != DayOfWeek.SATURDAY && weekday != DayOfWeek.SUNDAY) days++;
        }
        return days;
    }
}
