package rw.ac.auca.notification;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The RabbitMQ side of email:
 * <pre>
 *   NotificationListener --publish--> [smarthr.notifications] --email--> queue smarthr.email --> EmailConsumer --> SMTP
 *                                                                          |  (rejected after the last retry)
 *                                                                          v
 *                                     [smarthr.notifications.dead] --> queue smarthr.email.dead  (kept until an administrator retries it)
 * </pre>
 * Names start with "smarthr" unless {@code smarthr.queue.prefix} says otherwise (the tests use their own, so they never
 * touch the queues of a running app). Everything is declared when the app connects, so nothing has to be created by hand.
 */
@Configuration
public class RabbitConfig {

    static final String EMAIL_KEY = "email";
    static final String DEAD_KEY = "email.dead";

    private final String prefix;

    public RabbitConfig(@Value("${smarthr.queue.prefix:smarthr}") String prefix) {
        this.prefix = prefix;
    }

    public String exchangeName() {
        return prefix + ".notifications";
    }

    public String deadExchangeName() {
        return prefix + ".notifications.dead";
    }

    public String emailQueueName() {
        return prefix + ".email";
    }

    public String deadQueueName() {
        return prefix + ".email.dead";
    }

    @Bean
    DirectExchange notificationsExchange() {
        return new DirectExchange(exchangeName(), true, false);
    }

    @Bean
    DirectExchange deadLetterExchange() {
        return new DirectExchange(deadExchangeName(), true, false);
    }

    @Bean
    Queue emailAmqpQueue() {
        return QueueBuilder.durable(emailQueueName())
                .deadLetterExchange(deadExchangeName())
                .deadLetterRoutingKey(DEAD_KEY)
                .build();
    }

    @Bean
    Queue deadEmailAmqpQueue() {
        return QueueBuilder.durable(deadQueueName()).build();
    }

    @Bean
    Binding emailBinding() {
        return BindingBuilder.bind(emailAmqpQueue()).to(notificationsExchange()).with(EMAIL_KEY);
    }

    @Bean
    Binding deadBinding() {
        return BindingBuilder.bind(deadEmailAmqpQueue()).to(deadLetterExchange()).with(DEAD_KEY);
    }

    /** Messages travel as JSON, so a queue can be read (and a bad one fixed) by hand in the RabbitMQ console. */
    @Bean
    MessageConverter messageConverter() {
        return new JacksonJsonMessageConverter();
    }
}
