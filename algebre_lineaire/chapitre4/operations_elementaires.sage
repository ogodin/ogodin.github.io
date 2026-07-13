A = matrix([[2, 1], [1, -1]])
B = matrix([5, 1])
A_B = A.augment(B.T)

A_B = A_B.with_swapped_rows(0, 1)
show(A_B)

A_B = A_B.with_added_multiple_of_row(1, 0, -2)
show(A_B)

A_B = A_B.with_rescaled_row(1, 1/3)
show(A_B)