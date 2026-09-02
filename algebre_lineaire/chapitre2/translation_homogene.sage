# Sommets d'un cube
points = [
    matrix([[1], [1], [1]]),
    matrix([[3], [1], [1]]),
    matrix([[3], [3], [1]]),
    matrix([[1], [3], [1]]),
    matrix([[1], [1], [3]]),
    matrix([[3], [1], [3]]),
    matrix([[3], [3], [3]]),
    matrix([[1], [3], [3]])
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


def homogene(P):
    """Convertit une matrice colonne 3x1 en matrice homogène 4x1."""
    return matrix([
        [P[0, 0]],
        [P[1, 0]],
        [P[2, 0]],
        [1]
    ])


def cartesien(P):
    """Retire la coordonnée homogène."""
    return matrix([
        [P[0, 0]],
        [P[1, 0]],
        [P[2, 0]]
    ])


@interact
def translation(
    tx=slider(
        -3, 3, 0.5,
        default=0,
        label="Translation selon x"
    )
):
    # Matrice homogène de translation
    T = matrix([
        [1, 0, 0, tx],
        [0, 1, 0,  0],
        [0, 0, 1,  0],
        [0, 0, 0,  1]
    ])

    # Translation des sommets par multiplication matricielle
    points_transformes = [
        cartesien(T * homogene(P))
        for P in points
    ]

    # Affichage de la matrice de transformation
    show(
    LatexExpr(
        r"T(t_x)="
        r"\begin{bmatrix}"
        r"1 & 0 & 0 & t_x\\"
        r"0 & 1 & 0 & 0\\"
        r"0 & 0 & 1 & 0\\"
        r"0 & 0 & 0 & 1"
        r"\end{bmatrix}"
        )
    )

    show(
        LatexExpr(
            r"t_x=" + str(tx)
            + r"\qquad{} T=" + latex(T)
        )
    )

    # Affichage du cube original et du cube translaté
    show(
        dessiner(points, "blue") +
        dessiner(points_transformes, "red"),
        frame=False,
        axes=True,
        aspect_ratio=1
    )