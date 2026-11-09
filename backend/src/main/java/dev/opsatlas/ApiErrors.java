package dev.opsatlas;

import jakarta.validation.ConstraintViolationException;
import java.util.*;
import org.slf4j.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
class ApiErrors {
  private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<ProblemDetail> status(ResponseStatusException e) {
    return problem(e.getStatusCode(), e.getReason());
  }

  @ExceptionHandler({
    BindException.class,
    ConstraintViolationException.class,
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class
  })
  ResponseEntity<ProblemDetail> invalid(Exception e) {
    return problem(
        HttpStatus.BAD_REQUEST,
        "Invalid input. Check required fields, lengths, and allowed values.");
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<ProblemDetail> conflict(Exception e) {
    return problem(HttpStatus.CONFLICT, "This record conflicts with existing data.");
  }

  @ExceptionHandler(AuthenticationException.class)
  ResponseEntity<ProblemDetail> auth(Exception e) {
    return problem(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
  }

  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<ProblemDetail> denied(Exception e) {
    return problem(HttpStatus.FORBIDDEN, "You do not have permission for this action.");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ProblemDetail> unexpected(Exception e) {
    String reference = UUID.randomUUID().toString();
    log.error("Unexpected error reference={} type={}", reference, e.getClass().getSimpleName());
    return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error. Reference: " + reference);
  }

  private ResponseEntity<ProblemDetail> problem(HttpStatusCode status, String detail) {
    return ResponseEntity.status(status)
        .body(
            ProblemDetail.forStatusAndDetail(status, detail == null ? "Request failed." : detail));
  }

  static ResponseStatusException missing() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found.");
  }

  static ResponseStatusException bad(String detail) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, detail);
  }

  static ResponseStatusException conflict(String detail) {
    return new ResponseStatusException(HttpStatus.CONFLICT, detail);
  }
}
