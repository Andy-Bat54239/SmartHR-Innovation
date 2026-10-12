package rw.ac.auca.smarthr;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import rw.ac.auca.leave_request.service.LeaveAllowanceProperties;
import rw.ac.auca.notification.MailProperties;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EnableConfigurationProperties({LeaveAllowanceProperties.class, MailProperties.class})
@EnableAsync
@EnableScheduling
@ComponentScan(basePackages = "rw.ac.auca")
@EnableJpaRepositories(basePackages = "rw.ac.auca")
@EntityScan(basePackages = "rw.ac.auca")
public class SmartHrApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartHrApplication.class, args);
    }

}
