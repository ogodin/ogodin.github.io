A = matrix([[2, 1, -1], [-1, 3, 2], [3, -2, 4]])
B = matrix([3, 4, 5])

Ax = block_matrix([[B.T, A.column(1), A.column(2)]])
Ay = block_matrix([[A.column(0), B.T, A.column(2)]])
Az = block_matrix([[A.column(0), A.column(1), B.T]])

show(Ax.determinant()/A.determinant())
show(Ay.determinant()/A.determinant())
show(Az.determinant()/A.determinant())