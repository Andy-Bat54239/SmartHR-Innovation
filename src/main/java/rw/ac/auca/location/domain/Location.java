package rw.ac.auca.location.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.ac.auca.base.BaseEntity;

import java.util.ArrayList;
import java.util.List;

/**
 * One table for the five levels of Rwanda's administrative hierarchy.
 * Provinces have no parent; every other level points to the level above it.
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
public class Location extends BaseEntity {

    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be at most 100 characters")
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull(message = "Type is required")
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private LocationType type;

    // Optional, but unique when present (e.g. province code "KIG")
    @Size(max = 10, message = "Code must be at most 10 characters")
    @Column(name = "code", unique = true, length = 10)
    private String code;

    @ManyToOne
    @JoinColumn(name = "parent_id")
    private Location parent;

    @JsonIgnore
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    private List<Location> children = new ArrayList<>();
}
