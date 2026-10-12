package rw.ac.auca.department.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.ac.auca.base.BaseEntity;
import rw.ac.auca.employee.domain.Employee;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
public class Department extends BaseEntity {
    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be at most 100 characters")
    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @NotBlank(message = "Code is required")
    @Size(max = 20, message = "Code must be at most 20 characters")
    @Pattern(regexp = "^[A-Za-z0-9_-]*$", message = "Code may only contain letters, digits, '-' and '_'")
    @Column(name = "code", nullable = false, unique = true)
    private  String code;

    @Size(max = 255, message = "Description must be at most 255 characters")
    @Column(name = "description", nullable = true)
    private String description;

    @JsonIgnore
    @OneToMany(mappedBy = "department")
    private List<Employee> employees = new ArrayList<>();
}
