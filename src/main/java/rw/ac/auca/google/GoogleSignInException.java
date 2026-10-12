package rw.ac.auca.google;

/** Why a Google sign-in cannot go ahead, in words that are safe to show on the login page. */
public class GoogleSignInException extends RuntimeException {

    public GoogleSignInException(String message) {
        super(message);
    }
}
