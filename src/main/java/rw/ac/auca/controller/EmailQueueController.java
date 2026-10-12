package rw.ac.auca.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import rw.ac.auca.notification.EmailQueueAdmin;
import rw.ac.auca.notification.EmailQueueStatus;

import java.util.Map;

/** The email queue as an administrator sees it (ADMIN only, see SecurityConfig). */
@RestController
@RequestMapping("/notification/email-queue")
public class EmailQueueController {

    @Autowired
    private EmailQueueAdmin queue;

    /** How many emails are waiting, how many consumers are listening, and how many gave up after all their retries. */
    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public EmailQueueStatus status() {
        return queue.status();
    }

    /** Puts every dead-lettered email back on the queue for another round of attempts. */
    @PostMapping("/retry-dead")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Integer> retryDead() {
        return Map.of("requeued", queue.retryDead());
    }
}
