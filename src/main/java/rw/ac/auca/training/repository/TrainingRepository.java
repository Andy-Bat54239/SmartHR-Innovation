package rw.ac.auca.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import rw.ac.auca.training.domain.Training;

import java.util.List;
import java.util.UUID;

@Repository
public interface TrainingRepository extends JpaRepository<Training, UUID> {
    boolean existsByTitle(String title);
    List<Training> findByStartDate(java.time.LocalDate startDate);
    List<Training> findByEmployees_Id(UUID employeeId);
    List<Training> findByTitleContainingIgnoreCase(String title);
}
