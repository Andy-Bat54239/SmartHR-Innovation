package rw.ac.auca.training.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToMany;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.ac.auca.base.BaseEntity;
import rw.ac.auca.employee.domain.Employee;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
public class Training extends BaseEntity {

    @NotBlank(message = "Title is required")
    @Size(max = 200, message = "Title must be at most 200 characters")
    @Column(name = "title", nullable = false, unique = true, length = 200)
    private String title;

    @Size(max = 1000, message = "Description must be at most 1000 characters")
    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Size(max = 200, message = "Trainer must be at most 200 characters")
    @Column(name = "trainer", length = 200)
    private String trainer;

    // Inverse side: the join table is owned by Employee.trainings,
    // so enrolments must always be changed through the employee.
    @JsonIgnore
    @ManyToMany(mappedBy = "trainings")
    private Set<Employee> employees = new HashSet<>();
}
