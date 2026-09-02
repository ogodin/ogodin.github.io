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


def boite_fixe(limite=3.5):
    """Force une boîte englobante constante sans rien afficher."""
    return point3d(
        [
            (-limite, -limite, -limite),
            ( limite,  limite,  limite)
        ],
        opacity=0
    )


@interact
def reflexion(
    k=slider(
        -1, 1, 2,
        default=1,
        label="Valeur de k"
    )
):
    S = matrix([
        [k, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ])

    points_transformes = [S * P for P in points]

    show(
        LatexExpr(
            r"S(k)="
            r"\begin{bmatrix}"
            r"k & 0 & 0\\"
            r"0 & 1 & 0\\"
            r"0 & 0 & 1"
            r"\end{bmatrix}"
        )
    )

    show(
        LatexExpr(
            r"k=" + str(k)
            + r"\qquad{} S=" + latex(S)
        )
    )

    show(
        dessiner(points, "blue") +
        dessiner(points_transformes, "red") +
        boite_fixe(3.5),
        frame=False,
        axes=True,
        aspect_ratio=1
    )