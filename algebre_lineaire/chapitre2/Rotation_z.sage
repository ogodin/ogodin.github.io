# Sommets d'un cube centré à l'origine
points = [
    matrix([[ -1], [-1], [-1]]),
    matrix([[  1], [-1], [-1]]),
    matrix([[  1], [ 1], [-1]]),
    matrix([[ -1], [ 1], [-1]]),
    matrix([[ -1], [-1], [ 1]]),
    matrix([[  1], [-1], [ 1]]),
    matrix([[  1], [ 1], [ 1]]),
    matrix([[ -1], [ 1], [ 1]])
]

# Arêtes du cube
aretes = [
    (0, 1), (1, 2), (2, 3), (3, 0),
    (4, 5), (5, 6), (6, 7), (7, 4),
    (0, 4), (1, 5), (2, 6), (3, 7)
]


def coordonnees(P):
    """Convertit une matrice colonne 3x1 en coordonnées utilisables par Sage."""
    return (P[0, 0], P[1, 0], P[2, 0])


def dessiner(points, couleur="blue"):
    dessin = Graphics()

    for i, j in aretes:
        dessin += line3d(
            [coordonnees(points[i]), coordonnees(points[j])],
            color=couleur,
            thickness=4
        )

    dessin += point3d(
        [coordonnees(P) for P in points],
        color=couleur,
        size=20
    )

    return dessin

@interact
def rotation_z(
    theta_deg=slider(
        0, 360, 5,
        default=45,
        label="Angle de rotation (°)"
    )
):
    theta = theta_deg * pi / 180

    R = matrix([
        [cos(theta), -sin(theta), 0],
        [sin(theta),  cos(theta), 0],
        [0,           0,          1]
    ])

    points_rotation = [R * P for P in points]

    show(
        LatexExpr(
            r"R_z(\theta)="
            r"\begin{bmatrix}"
            r"\cos\theta & -\sin\theta & 0\\"
            r"\sin\theta & \cos\theta & 0\\"
            r"0 & 0 & 1"
            r"\end{bmatrix}"
        )
    )

    show(
    LatexExpr(
        r"\theta=" + str(theta_deg) + r"^\circ"
        r"\qquad{} R_z=" + latex(R.n(digits=3))
    )
)

    show(
        dessiner(points, "blue") +
        dessiner(points_rotation, "red"),
        frame=False,
        axes=True,
        aspect_ratio=1
    )