package rw.ac.auca.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.training.domain.Training;
import rw.ac.auca.training.service.TrainingService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/training")
public class TrainingController {

    @Autowired
    private TrainingService trainingService;

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    public Training createTraining(@Valid @RequestBody Training training){
        return trainingService.registerTraining(training);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Training updateTraining(@PathVariable UUID id, @Valid @RequestBody Training training){
        training.setId(id);
        return trainingService.updateTraining(training);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTraining(@PathVariable UUID id){
        Training training = new Training();
        training.setId(id);
        trainingService.deleteTraining(training);
    }

    @GetMapping("/search-all")
    @ResponseStatus(HttpStatus.OK)
    public List<Training> findAllTrainings(){
        return trainingService.findAllTrainings();
    }

    @GetMapping("/search/{id}")
    @ResponseStatus(HttpStatus.OK)
    public Training findTrainingById(@PathVariable UUID id){
        Training training = new Training();
        training.setId(id);
        return trainingService.findTrainingById(training);
    }

    @GetMapping("/search")
    @ResponseStatus(HttpStatus.OK)
    public List<Training> searchTrainingsByTitle(@RequestParam String title){
        return trainingService.searchTrainingsByTitle(title);
    }

    @PostMapping("/{trainingId}/assign/{employeeId}")
    @ResponseStatus(HttpStatus.OK)
    public Training assignEmployee(@PathVariable UUID trainingId, @PathVariable UUID employeeId){
        return trainingService.assignEmployeeToTraining(trainingId, employeeId);
    }

    @DeleteMapping("/{trainingId}/remove/{employeeId}")
    @ResponseStatus(HttpStatus.OK)
    public Training removeEmployee(@PathVariable UUID trainingId, @PathVariable UUID employeeId){
        return trainingService.removeEmployeeFromTraining(trainingId, employeeId);
    }

    @GetMapping("/employee/{employeeId}")
    @ResponseStatus(HttpStatus.OK)
    public List<Training> findTrainingsByEmployee(@PathVariable UUID employeeId){
        return trainingService.findTrainingsByEmployee(employeeId);
    }

    @GetMapping("/{trainingId}/employees")
    @ResponseStatus(HttpStatus.OK)
    public List<Employee> findEmployeesByTraining(@PathVariable UUID trainingId){
        return trainingService.findEmployeesByTraining(trainingId);
    }
}
