package rw.ac.auca.leave_request.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import rw.ac.auca.leave_request.domain.LeaveType;

/**
 * How many working days of each kind of leave one employee gets per calendar year ("smarthr.leave" in
 * application.properties). A type with no limit (unpaid leave) has no balance to run out of.
 */
@ConfigurationProperties(prefix = "smarthr.leave")
public record LeaveAllowanceProperties(Integer annualDays, Integer sickDays) {

    public LeaveAllowanceProperties {
        if (annualDays == null) annualDays = 18;
        if (sickDays == null) sickDays = 15;
    }

    /** Working days per year for this type, or null when the type is not limited. */
    public Integer allowanceFor(LeaveType type) {
        return switch (type) {
            case ANNUAL -> annualDays;
            case SICK -> sickDays;
            case UNPAID -> null;
        };
    }
}
