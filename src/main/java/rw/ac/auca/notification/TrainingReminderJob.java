package rw.ac.auca.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.employee.domain.Employee;
import rw.ac.auca.training.domain.Training;
import rw.ac.auca.training.repository.TrainingRepository;

import java.time.LocalDate;

/**
 * Every morning at 07:00 server time, emails the people enrolled in a training that starts in
 * {@code smarthr.mail.reminder-days-before} days (default 1: tomorrow). Each training is picked up on exactly one day,
 * so nobody gets the reminder twice.
 */
@Component
public class TrainingReminderJob {

    private static final Logger log = LoggerFactory.getLogger(TrainingReminderJob.class);

    @Autowired
    private TrainingRepository trainings;

    @Autowired
    private NotificationListener notifications;

    @Autowired
    private MailProperties properties;

    @Scheduled(cron = "${smarthr.mail.reminder-cron:0 0 7 * * *}")
    @Transactional(readOnly = true)
    public void remind() {
        LocalDate day = LocalDate.now().plusDays(properties.reminderDaysBefore());
        int sent = 0;
        for (Training training : trainings.findByStartDate(day)) {
            for (Employee employee : training.getEmployees()) {
                notifications.remindTraining(employee.getId(), training.getTitle(), training.getStartDate(), training.getEndDate(),
                        training.getTrainer(), properties.reminderDaysBefore() == 1);
                sent++;
            }
        }
        if (sent > 0) log.info("Training reminders: {} people told about trainings starting on {}", sent, day);
    }
}
