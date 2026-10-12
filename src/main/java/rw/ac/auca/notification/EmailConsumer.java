package rw.ac.auca.notification;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Takes emails off the queue and sends them. When sending fails the exception makes Spring retry it (the delays are
 * under "spring.rabbitmq.listener.simple.retry" in application.properties); after the last attempt the message is
 * rejected and RabbitMQ moves it to the dead-letter queue, where it waits for an administrator.
 */
@Component
public class EmailConsumer {

    @Autowired
    private EmailService email;

    @RabbitListener(queues = "${smarthr.queue.prefix:smarthr}.email")
    public void onEmail(EmailMessage message) {
        email.deliver(message);
    }
}
