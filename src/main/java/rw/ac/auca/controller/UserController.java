package rw.ac.auca.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import rw.ac.auca.security.AuthenticatedUser;
import rw.ac.auca.user.domain.AppUser;
import rw.ac.auca.user.dto.AccountCreatedResponse;
import rw.ac.auca.user.dto.CreateUserRequest;
import rw.ac.auca.user.dto.UpdateUserRequest;
import rw.ac.auca.user.dto.UserResponse;
import rw.ac.auca.user.service.TwoFactorService;
import rw.ac.auca.user.service.UserService;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/** Managing accounts: ADMIN only (see SecurityConfig). */
@RestController
@RequestMapping("/user")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private TwoFactorService twoFactorService;

    /** Creates an account with a generated temporary password, returned this once and to be changed at the first login. */
    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    public AccountCreatedResponse createUser(@Valid @RequestBody CreateUserRequest request) {
        return toResponse(userService.createAccount(request));
    }

    @GetMapping("/search-all")
    @ResponseStatus(HttpStatus.OK)
    public List<UserResponse> findAllUsers() {
        return userService.findAll().stream()
                .sorted(Comparator.comparing(AppUser::getUsername))
                .map(UserResponse::from)
                .toList();
    }

    @GetMapping("/search/{id}")
    @ResponseStatus(HttpStatus.OK)
    public UserResponse findUserById(@PathVariable UUID id) {
        return UserResponse.from(userService.findById(id));
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public UserResponse updateUser(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest request,
                                   @AuthenticationPrincipal AuthenticatedUser me) {
        return UserResponse.from(userService.updateAccount(id, request, me.id()));
    }

    /** New temporary password, returned once. The person is signed out everywhere and must choose their own. */
    @PostMapping("/{id}/reset-password")
    @ResponseStatus(HttpStatus.OK)
    public AccountCreatedResponse resetPassword(@PathVariable UUID id) {
        return toResponse(userService.resetPassword(id));
    }

    /** Removes someone's two-factor sign-in (they lost their phone) and signs them out everywhere. Not your own. */
    @PostMapping("/{id}/reset-two-factor")
    @ResponseStatus(HttpStatus.OK)
    public UserResponse resetTwoFactor(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser me) {
        return UserResponse.from(twoFactorService.reset(id, me.id()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedUser me) {
        userService.deleteAccount(id, me.id());
    }

    private AccountCreatedResponse toResponse(UserService.CreatedAccount created) {
        return new AccountCreatedResponse(UserResponse.from(created.user()), created.temporaryPassword());
    }
}
