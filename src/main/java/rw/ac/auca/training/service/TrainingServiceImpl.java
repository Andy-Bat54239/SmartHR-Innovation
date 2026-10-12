package rw.ac.auca.training.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import rw.ac.auca.notification.NotificationEvents;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.employee.repository.EmployeeRepository;
import rw.ac.auca.exception.DuplicateResourceException;
import rw.ac.auca.exception.FieldValidationException;
import rw.ac.auca.exception.ResourceNotFoundException;
import rw.ac.auca.training.domain.Training;
import rw.ac.auca.training.repository.TrainingRepository;
import rw.ac.auca.audit.domain.AuditAction;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.audit.service.AuditSnapshot;
import rw.ac.auca.audit.service.AuditSnapshots;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class TrainingServiceImpl implements TrainingService {

    @Autowired
    private ApplicationEventPublisher events;

    @Autowired
    private TrainingRepository trainingRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private AuditService audit;

    @Override
    @Transactional
    public Training registerTraining(Training training) {
        checkDates(training.getStartDate(), training.getEndDate());
        if (trainingRepository.existsByTitle(training.getTitle())) {
            throw new DuplicateResourceException("title", "Training title already in use: " + training.getTitle());
        }
        Training saved = trainingRepository.save(training);
        audit.created(AuditEntity.TRAINING, saved.getId(), AuditSnapshots.label(saved), AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public Training updateTraining(Training training) {
        Training found = findTrainingById(training);
        AuditSnapshot before = AuditSnapshots.of(found);
        checkDates(training.getStartDate(), training.getEndDate());

        // Only re-check uniqueness when the value actually changes
        if (!found.getTitle().equals(training.getTitle())
                && trainingRepository.existsByTitle(training.getTitle())) {
            throw new DuplicateResourceException("title", "Training title already in use: " + training.getTitle());
        }

        found.setTitle(training.getTitle());
        found.setDescription(training.getDescription());
        found.setStartDate(training.getStartDate());
        found.setEndDate(training.getEndDate());
        found.setTrainer(training.getTrainer());
        Training saved = trainingRepository.save(found);
        audit.updated(AuditEntity.TRAINING, saved.getId(), AuditSnapshots.label(saved), before, AuditSnapshots.of(saved));
        return saved;
    }

    @Override
    @Transactional
    public void deleteTraining(Training training) {
        Training found = findTrainingById(training);
        AuditSnapshot snapshot = AuditSnapshots.of(found);
        String label = AuditSnapshots.label(found);
        int enrolled = found.getEmployees().size();
        // The employee side owns the join table, so un-enrol everybody through it first
        for (Employee employee : new ArrayList<>(found.getEmployees())) {
            employee.getTrainings().remove(found);
        }
        trainingRepository.delete(found);
        audit.deleted(AuditEntity.TRAINING, found.getId(), label, snapshot,
                enrolled == 0 ? null : enrolled + (enrolled == 1 ? " person was" : " people were") + " removed from it");
    }

    @Override
    @Transactional(readOnly = true)
    public Training findTrainingById(Training training) {
        return trainingRepository.findById(training.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Training", training.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Training> findAllTrainings() {
        return trainingRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Training> searchTrainingsByTitle(String title) {
        return trainingRepository.findByTitleContainingIgnoreCase(title);
    }

    @Override
    @Transactional
    public Training assignEmployeeToTraining(UUID trainingId, UUID employeeId) {
        Training training = loadTraining(trainingId);
        Employee employee = loadEmployee(employeeId);
        if (employee.getTrainings().contains(training)) {
            throw new DuplicateResourceException("Employee is already enrolled in this training");
        }
        employee.getTrainings().add(training);   // owning side
        employeeRepository.save(employee);
        audit.action(AuditAction.TRAINING_ENROLLED, AuditEntity.TRAINING, training.getId(), AuditSnapshots.label(training),
                "Enrolled " + AuditSnapshots.label(employee) + " in " + AuditSnapshots.label(training), null);
        events.publishEvent(new NotificationEvents.TrainingEnrolled(employee.getId(), employee.getFirstName() + " " + employee.getLastName(),
                training.getTitle(), training.getStartDate(), training.getEndDate(), training.getTrainer()));
        return training;
    }

    @Override
    @Transactional
    public Training removeEmployeeFromTraining(UUID trainingId, UUID employeeId) {
        Training training = loadTraining(trainingId);
        Employee employee = loadEmployee(employeeId);
        if (!employee.getTrainings().remove(training)) {  // owning side
            throw new ResourceNotFoundException("Employee is not enrolled in this training");
        }
        employeeRepository.save(employee);
        audit.action(AuditAction.TRAINING_REMOVED, AuditEntity.TRAINING, training.getId(), AuditSnapshots.label(training),
                "Removed " + AuditSnapshots.label(employee) + " from " + AuditSnapshots.label(training), null);
        return training;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Training> findTrainingsByEmployee(UUID employeeId) {
        loadEmployee(employeeId);
        return trainingRepository.findByEmployees_Id(employeeId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Employee> findEmployeesByTraining(UUID trainingId) {
        return new ArrayList<>(loadTraining(trainingId).getEmployees());
    }

    private Training loadTraining(UUID id) {
        return trainingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Training", id));
    }

    private Employee loadEmployee(UUID id) {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", id));
    }

    private void checkDates(LocalDate start, LocalDate end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw new FieldValidationException("endDate", "End date cannot be before start date");
        }
    }
}
