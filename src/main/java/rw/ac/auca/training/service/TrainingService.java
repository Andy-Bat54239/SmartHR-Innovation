package rw.ac.auca.training.service;

import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.training.domain.Training;

import java.util.List;
import java.util.UUID;

public interface TrainingService {
    Training registerTraining(Training training);
    Training updateTraining(Training training);
    void deleteTraining(Training training);
    Training findTrainingById(Training training);
    List<Training> findAllTrainings();
    List<Training> searchTrainingsByTitle(String title);

    Training assignEmployeeToTraining(UUID trainingId, UUID employeeId);
    Training removeEmployeeFromTraining(UUID trainingId, UUID employeeId);
    List<Training> findTrainingsByEmployee(UUID employeeId);
    List<Employee> findEmployeesByTraining(UUID trainingId);
}
