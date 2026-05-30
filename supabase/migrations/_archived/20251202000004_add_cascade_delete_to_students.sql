-- Add ON DELETE CASCADE to attendance table
ALTER TABLE attendance
DROP CONSTRAINT attendance_student_id_fkey;

ALTER TABLE attendance
ADD CONSTRAINT attendance_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES students(id)
ON DELETE CASCADE;

-- Add ON DELETE CASCADE to payments table
ALTER TABLE payments
DROP CONSTRAINT payments_student_id_fkey;

ALTER TABLE payments
ADD CONSTRAINT payments_student_id_fkey
FOREIGN KEY (student_id)
REFERENCES students(id)
ON DELETE CASCADE;