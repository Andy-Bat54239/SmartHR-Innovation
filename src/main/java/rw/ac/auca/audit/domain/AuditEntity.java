package rw.ac.auca.audit.domain;

/** The kind of record an event is about. */
public enum AuditEntity {
    EMPLOYEE("employee"),
    PROFILE("profile"),
    DEPARTMENT("department"),
    LOCATION("location"),
    TRAINING("training"),
    LEAVE_REQUEST("leave request"),
    ACCOUNT("account");

    private final String noun;

    AuditEntity(String noun) {
        this.noun = noun;
    }

    /** How it reads in a sentence: "Created employee Aline Uwase". */
    public String noun() {
        return noun;
    }
}
