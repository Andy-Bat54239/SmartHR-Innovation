package rw.ac.auca.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

/**
 * Writes an error in the same JSON shape as GlobalExceptionHandler, for the places that run before a
 * controller (the security filters), where that handler cannot reach.
 */
@Component
public class ApiErrorWriter {

    public void write(HttpServletResponse response, HttpStatus status, String message, String code, String path) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        StringBuilder json = new StringBuilder("{")
                .append("\"timestamp\":\"").append(LocalDateTime.now()).append("\",")
                .append("\"status\":").append(status.value()).append(',')
                .append("\"error\":\"").append(escape(status.getReasonPhrase())).append("\",")
                .append("\"message\":\"").append(escape(message)).append('"');
        if (code != null) {
            json.append(",\"code\":\"").append(escape(code)).append('"');
        }
        json.append(",\"path\":\"").append(escape(path)).append("\"}");
        response.getWriter().write(json.toString());
    }

    private String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }
}
