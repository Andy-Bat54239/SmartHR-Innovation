package rw.ac.auca.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.QueueInformation;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Looks at the email queue and puts dead-lettered emails back for another try. */
@Service
public class EmailQueueAdmin {

    private static final Logger log = LoggerFactory.getLogger(EmailQueueAdmin.class);

    @Autowired
    private AmqpAdmin admin;

    @Autowired
    private RabbitTemplate rabbit;

    @Autowired
    private RabbitConfig names;

    public EmailQueueStatus status() {
        try {
            QueueInformation main = admin.getQueueInfo(names.emailQueueName());
            QueueInformation dead = admin.getQueueInfo(names.deadQueueName());
            if (main == null || dead == null) return new EmailQueueStatus(false, 0, 0, 0);
            return new EmailQueueStatus(true, main.getMessageCount(), main.getConsumerCount(), dead.getMessageCount());
        } catch (AmqpException e) {
            log.warn("Could not read the email queue: {}", e.getMessage());
            return new EmailQueueStatus(false, 0, 0, 0);
        }
    }

    /** Moves every dead-lettered email back onto the queue (they get the full set of retries again). Returns how many. */
    public int retryDead() {
        int moved = 0;
        Message message;
        while ((message = rabbit.receive(names.deadQueueName())) != null) {
            rabbit.send(names.exchangeName(), RabbitConfig.EMAIL_KEY, message);
            moved++;
        }
        if (moved > 0) log.info("{} dead-lettered emails were put back on the queue", moved);
        return moved;
    }
}
