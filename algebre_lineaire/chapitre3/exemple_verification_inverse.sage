B = matrix([[2, -1, 4], [0, 3, 1], [-2, 5, 7]])

B_inverse = matrix([[8/29, 27/58, -13/58],
                    [-1/29, 11/29, -1/29],
                    [3/29, -4/29, 3/29]])

show(B * B_inverse)
show(B_inverse * B)