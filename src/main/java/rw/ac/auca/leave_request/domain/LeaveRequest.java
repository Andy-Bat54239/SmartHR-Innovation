package rw.ac.auca.leave_request.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.ac.auca.base.BaseEntity;
import rw.ac.auca.base.OnCreate;
import rw.ac.auca.employee.domain.Employee;

import java.time.LocalDate;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
public class LeaveRequest extends BaseEntity {

    @NotNull(message = "Start date is required")
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @NotNull(message = "End date is required")
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Size(max = 1000, message = "Reason must be at most 1000 characters")
    @Column(name = "reason", length = 1000)
    private String reason;

    // Why HR/ADMIN rejected the request. Set only by the reject endpoint; whatever a client sends is ignored.
    @Column(name = "rejection_reason", length = 1000)
    private String rejectionReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private LeaveStatus status = LeaveStatus.PENDING;

    @NotNull(message = "Type is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "leave_type", nullable = false)
    private LeaveType type;

    // Required when a request is submitted (group OnCreate); an update never resends it, the owner cannot change
    @NotNull(groups = OnCreate.class, message = "Choose the employee this leave is for")
    @ManyToOne(optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;
}
