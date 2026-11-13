# Non-funtinal requirement
-  Security:
    - The system shall authenticate users using usernamepassword.
    - The system shall be able to keep user’s transactions confidential.
-  Performance:
    - The system shall response to a request in 3 seconds.
- Usability:
    - The system shall be used and test via Postman.

# Specified functional requirement
1. The system shall allow a user to register by specifying the name, telephone number, email, and
password.
2. After registration, the user becomes a registered user, and the system shall allow the user to log in to use the system by specifying the email and password. 
The system shall allow a registered user to log
out.
3. After login, the system shall allow the registered user to reserve up to 3 queues by specifying the date
and the preferred massage shop. The massage shop list is also provided to the user. A massage shop
information includes the name, address, telephone number, and open-close time.
4. The system shall allow the registered user to view his/her massage reservation.
5. The system shall allow the registered user to edit his/her massage reservation.
6. The system shall allow the registered user to delete his/her massage reservation.
7. The system shall allow the admin to view any massage reservation.
8. The system shall allow the admin to edit any massage reservation.
9. The system shall allow the admin to delete any massage reservation.

# Additional Requirements

1. The system shall allow the admin to create new massage shop information.
2. The system shall allow the admin to edit existing massage shop information.
3. The system shall allow registered users to submit a rating from 1 to 5 stars after completing a reservation.
4. The system shall provide a secure password reset process. The system shall send an OTP to the user's registered email address. After successfully verifying the OTP, the user shall be allowed to set and confirm a new password.
5. The system shall automatically send an email notification to the admin when a customer successfully makes a reservation.
6. The system shall automatically send a welcome email to newly registered users containing a unique promotional discount coupon (promo code) after successful account registration.
7. The system shall allow the admin to create a special closing date for a massage shop.
8. The system shall allow the admin to view the list of special closing dates for each massage shop.
9. The system shall allow the admin to update an existing special closing date.
10. The system shall allow the admin to delete an existing special closing date.

# Additional Functionalities (For Testing and Workflow Support)

1. The system shall allow registered users to specify a reservation start time.
2. The system shall allow registered users to manually update the status of their own reservations to either `completed` or `cancelled`. No time-based validation shall be applied. This functionality is implemented to facilitate rating submission during testing.
3. The system shall allow the admin to manually update the status of any reservation to either `completed` or `cancelled`. No time-based validation shall be applied. This functionality is implemented to facilitate rating submission during testing.
4. The system shall allow both admins and registered users to view all massage shop information.
5. The system shall allow both admins and registered users to view all ratings.