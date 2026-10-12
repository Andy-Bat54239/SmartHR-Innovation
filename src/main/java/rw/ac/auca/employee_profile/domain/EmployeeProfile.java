package rw.ac.auca.employee_profile.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToOne;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.ac.auca.base.BaseEntity;
import rw.ac.auca.employee.domain.Employee;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
public class EmployeeProfile extends BaseEntity {

    // Rwandan national ID numbers have 16 digits
    @NotBlank(message = "National ID is required")
    @Pattern(regexp = "^\\d{16}$", message = "National ID must be exactly 16 digits")
    @Column(name = "national_id", nullable = false, unique = true, length = 20)
    private String nationalId;

    @NotNull(message = "Date of birth is required")
    @Past(message = "Date of birth must be in the past")
    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @NotBlank(message = "Education level is required")
    @Size(max = 100, message = "Education level must be at most 100 characters")
    @Column(name = "education_level", nullable = false)
    private String educationLevel;

    @Size(max = 255, message = "Photo URL must be at most 255 characters")
    @Column(name = "profile_photo_url")
    private String profilePhotoUrl;

    @JsonIgnore
    @OneToOne(mappedBy = "profile")
    private Employee employee;

}
