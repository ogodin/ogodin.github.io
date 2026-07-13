A = matrix([[1, 1, 0], [0, 1, 1], [1, 0, 1]])
I = identity_matrix(3)

A_I = A.augment(I)

show(A_I.rref())