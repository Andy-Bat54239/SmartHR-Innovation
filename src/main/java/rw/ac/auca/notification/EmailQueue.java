package rw.ac.auca.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Puts an email on the queue. If RabbitMQ cannot be reached at that moment the email is sent straight away instead
 * (once, without retries), so a broker that is down never silently swallows a notification.
 */
@Component
public class EmailQueue {

    private static final Logger log = LoggerFactory.getLogger(EmailQueue.class);

    @Autowired
    private RabbitTemplate rabbit;

    @Autowired
    private RabbitConfig names;

    @Autowired
    private EmailService email;

    public void enqueue(EmailMessage message) {
        try {
            rabbit.convertAndSend(names.exchangeName(), RabbitConfig.EMAIL_KEY, message, m -> {
                m.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);   // survives a broker restart
                return m;
            });
        } catch (AmqpException e) {
            log.warn("RabbitMQ is not reachable ({}): sending \"{}\" to {} directly, without retries", e.getMessage(), message.subject(), message.to());
            try {
                email.deliver(message);
            } catch (RuntimeException failed) {
                log.warn("The direct send failed too: {}", failed.getMessage());
            }
        }
    }
}
