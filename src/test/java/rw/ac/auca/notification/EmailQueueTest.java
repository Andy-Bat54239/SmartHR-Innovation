package rw.ac.auca.notification;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import rw.ac.auca.smarthr.SmartHrApplication;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

/**
 * The email queue against a real RabbitMQ (docker compose up -d), with its own queue names so it never touches the ones of a
 * running app, and a scratch database (createdb smarthr_test). The SMTP side is replaced, so nothing is really sent.
 * Skipped when no broker answers on localhost:5672.
 */
@SpringBootTest(
        classes = SmartHrApplication.class,
        properties = {
                "spring.datasource.url=jdbc:postgresql://localhost:5432/smarthr_test",
                "spring.jpa.hibernate.ddl-auto=create-drop",
                "smarthr.seed.enabled=false",
                "smarthr.queue.prefix=smarthr.test",
                "smarthr.security.bootstrap-admin.password=Admin-Passw0rd-Test",
                // quick retries so the test does not wait minutes
                "spring.rabbitmq.listener.simple.retry.max-retries=2",   // 3 attempts in all,
                "spring.rabbitmq.listener.simple.retry.initial-interval=100ms",
                "spring.rabbitmq.listener.simple.retry.multiplier=1",
        })
class EmailQueueTest {

    @Autowired
    EmailQueue queue;

    @Autowired
    EmailQueueAdmin admin;

    @Autowired
    AmqpAdmin amqp;

    @Autowired
    RabbitConfig names;

    @MockitoBean
    EmailService email;

    @AfterEach
    void emptyTheQueues() {
        amqp.purgeQueue(names.emailQueueName(), true);
        amqp.purgeQueue(names.deadQueueName(), true);
    }

    @BeforeAll
    static void brokerIsUp() {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("localhost", 5672), 1000);
        } catch (Exception e) {
            assumeTrue(false, "RabbitMQ is not running on localhost:5672 (docker compose up -d)");
        }
    }

    private static EmailMessage mail(String subject) {
        return new EmailMessage("someone@example.com", subject, "Headline", "Body", null, null);
    }

    private static org.mockito.ArgumentMatcher<EmailMessage> subject(String subject) {
        return m -> m.subject().equals(subject);
    }

    @Test
    void anEmailOnTheQueueIsDelivered() {
        queue.enqueue(mail("delivered"));
        verify(email, timeout(10_000)).deliver(argThat(subject("delivered")));
    }

    @Test
    void aFailedSendIsRetriedUntilItWorks() {
        AtomicInteger attempts = new AtomicInteger();
        doAnswer(call -> {
            if (attempts.incrementAndGet() < 3) throw new IllegalStateException("mail server down");
            return null;
        }).when(email).deliver(argThat(subject("flaky")));

        queue.enqueue(mail("flaky"));

        verify(email, timeout(10_000).times(3)).deliver(argThat(subject("flaky")));
        assertEquals(0, admin.status().dead(), "it worked on the third try, so nothing is dead");
    }

    @Test
    void anEmailThatKeepsFailingIsDeadLetteredAndCanBeRetried() throws Exception {
        AtomicInteger attempts = new AtomicInteger();
        doAnswer(call -> {
            // the first 3 attempts fail (the whole retry budget), after that the mail server "comes back"
            if (attempts.incrementAndGet() <= 3) throw new IllegalStateException("mail server down");
            return null;
        }).when(email).deliver(argThat(subject("doomed")));

        queue.enqueue(mail("doomed"));

        // all 3 attempts used up: it waits in the dead-letter queue
        long deadline = System.currentTimeMillis() + 10_000;
        while (admin.status().dead() < 1 && System.currentTimeMillis() < deadline) Thread.sleep(100);
        assertEquals(1, admin.status().dead());
        verify(email, timeout(5_000).times(3)).deliver(argThat(subject("doomed")));

        // an administrator puts it back: now it is delivered
        assertEquals(1, admin.retryDead());
        verify(email, timeout(10_000).times(4)).deliver(argThat(subject("doomed")));
        deadline = System.currentTimeMillis() + 5_000;
        while (admin.status().dead() > 0 && System.currentTimeMillis() < deadline) Thread.sleep(100);
        assertEquals(0, admin.status().dead());
        assertTrue(admin.status().available());
    }
}
