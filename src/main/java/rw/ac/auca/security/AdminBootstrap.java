package rw.ac.auca.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import rw.ac.auca.audit.domain.AuditEntity;
import rw.ac.auca.audit.service.AuditService;
import rw.ac.auca.audit.service.AuditSnapshots;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.domain.Role;
import rw.ac.auca.user.repository.AppUserRepository;
import rw.ac.auca.user.service.PasswordGenerator;

import java.util.Locale;

/**
 * With no accounts at all nobody could ever sign in to create one, so the very first start creates an
 * administrator. The password is taken from SMARTHR_ADMIN_PASSWORD; without it a random one is generated
 * and printed once in the log, and it must be changed at the first login.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    @Autowired
    private AppUserRepository users;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private SecurityProperties properties;

    @Autowired
    private AuditService audit;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        String username = properties.bootstrapAdmin().username().trim().toLowerCase(Locale.ROOT);
        String configured = properties.bootstrapAdmin().password();
        boolean generated = configured == null || configured.isBlank();
        String password = generated ? PasswordGenerator.generate() : configured;

        AppUser admin = new AppUser();
        admin.setUsername(username);
        admin.setPasswordHash(encoder.encode(password));
        admin.setRole(Role.ADMIN);
        admin.setEnabled(true);
        admin.setMustChangePassword(generated);   // a password nobody chose must not stay in use
        AppUser saved = users.save(admin);
        audit.created(AuditEntity.ACCOUNT, saved.getId(), AuditSnapshots.label(saved), AuditSnapshots.of(saved));

        if (generated) {
            log.warn("""

                    ================================================================
                     First start: an administrator account was created.
                       username: {}
                       password: {}
                     The password is shown only this once. Sign in and change it.
                    ================================================================""", username, password);
        } else {
            log.info("First start: administrator account {} created with the password from SMARTHR_ADMIN_PASSWORD", username);
        }
    }
}
