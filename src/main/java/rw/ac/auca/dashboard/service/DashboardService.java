package rw.ac.auca.dashboard.service;

public interface DashboardService {

    /** Headcount by department and province, leave and training figures, as of today. */
    DashboardSummary getSummary();
}
