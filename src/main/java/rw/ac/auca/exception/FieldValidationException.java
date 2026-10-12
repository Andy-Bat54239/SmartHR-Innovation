package rw.ac.auca.exception;

/**
 * A 400 that is about one input field, so a form can show the message next to it.
 * The response carries it as {"errors": {"<field>": "<message>"}}, like a failed Bean Validation check.
 * It is still an IllegalArgumentException, so code that only cares about "bad input" treats it the same way.
 */
public class FieldValidationException extends IllegalArgumentException {

    private final String field;

    public FieldValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
