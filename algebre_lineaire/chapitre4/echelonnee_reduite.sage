A = matrix([[1, 1], [2, -1], [-1, 3]])
B = matrix([1, 5, -5])

A_B = A.augment(B.T)

show(A_B.rref())