package rw.ac.auca.employee.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.ac.auca.base.BaseEntity;
import rw.ac.auca.department.domain.Department;
import rw.ac.auca.employee_profile.domain.EmployeeProfile;
import rw.ac.auca.leave_request.domain.LeaveRequest;
import rw.ac.auca.location.domain.Location;
import rw.ac.auca.training.domain.Training;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
public class Employee extends BaseEntity {

    /** Rwandan mobile number: +250 or 0, then 72/73/78/79, then 7 digits (e.g. +250788123456, 0788123456). */
    public static final String RWANDA_PHONE_REGEX = "^(\\+250|0)7[2389]\\d{7}$";

    @NotBlank(message = "First name is required")
    @Size(max = 50, message = "First name must be at most 50 characters")
    @Column(name = "first_name", nullable = false)
    private String firstName;

    @NotBlank(message = "Last name is required")
    @Size(max = 50, message = "Last name must be at most 50 characters")
    @Column(name = "last_name", nullable = false)
    private String lastName;

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be a well-formed email address")
    @Size(max = 150, message = "Email must be at most 150 characters")
    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @NotBlank(message = "Phone is required")
    @Pattern(regexp = RWANDA_PHONE_REGEX, message = "Phone must be a Rwandan mobile number like +250788123456 or 0788123456")
    @Column(name = "phone", nullable = false, unique = true, length = 20)
    private String phone;

    @NotNull(message = "Gender is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "gender", nullable = false)
    private Gender gender;

    @NotNull(message = "Hire date is required")
    @PastOrPresent(message = "Hire date cannot be in the future")
    @Column(name = "hire_date", nullable = false)
    private LocalDate hireDate;

    @NotNull(message = "Status is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private EmployeeStatus status;

    @ManyToOne
    @JoinColumn(name = "department_id")
    private Department department;

    // Owning side. Deleting an employee (or un-linking the profile) deletes the profile row.
    // No MERGE/PERSIST cascade on purpose: a profile is created through its own endpoint
    // and only referenced here by id.
    @OneToOne(cascade = CascadeType.REMOVE, orphanRemoval = true)
    @JoinColumn(name = "employee_profile_id", unique = true)
    private EmployeeProfile profile;

    // Usually a VILLAGE; the province is found by walking up the parents
    @ManyToOne
    @JoinColumn(name = "location_id")
    private Location location;

    // Deleting an employee deletes their leave requests
    @JsonIgnore
    @OneToMany(mappedBy = "employee", cascade = CascadeType.ALL)
    private List<LeaveRequest> leaveRequests = new ArrayList<>();

    // Owning side of the many-to-many: enrol/un-enrol by changing this set
    @JsonIgnore
    @ManyToMany
    @JoinTable(
            name = "employee_trainings",
            joinColumns = @JoinColumn(name = "employee_id"),
            inverseJoinColumns = @JoinColumn(name = "training_id")
    )
    private Set<Training> trainings = new HashSet<>();
}
