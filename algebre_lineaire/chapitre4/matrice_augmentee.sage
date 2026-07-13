A = matrix([[2, -1, 4], [4, -2, 1], [3, -1, 2], [-2, 5, -3]])
B = matrix([25, 20, 50, 6])
     
A_B = A.augment(B.T)
show(A_B)