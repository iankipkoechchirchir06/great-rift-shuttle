CREATE DATABASE greatriftshuttle;

USE greatriftshuttle;

CREATE TABLE routes (
    route_id INT AUTO_INCREMENT PRIMARY KEY,
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    distance_km INT,
    estimated_duration TIME
);

alter table routes modify column estimated_duration int; 

CREATE TABLE vehicles (
    number_plate VARCHAR(20) PRIMARY KEY,
    model VARCHAR(50),
    color VARCHAR(30),
    capacity INT NOT NULL, -- Total seats available
    exterior_img_url VARCHAR(255),
    interior_img_url VARCHAR(255),
    status ENUM('active', 'maintenance', 'retired') DEFAULT 'active'
);

CREATE TABLE drivers (
    driver_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    id_number VARCHAR(20) UNIQUE NOT NULL, -- National ID or Passport
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry_date DATE NOT NULL,
    driver_photo_url VARCHAR(200),
    date_joined DATE DEFAULT (CURRENT_DATE),
    status ENUM('active', 'on_leave', 'suspended', 'terminated') DEFAULT 'active',
    rating_cache DECIMAL(3, 2) DEFAULT 5.00 -- Calculated average rating
);


CREATE TABLE trips (
    trip_id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT,
    number_plate VARCHAR(20),
    driver_id INT, 
    departure_time DATETIME NOT NULL,
    arrival_time DATETIME,
    status ENUM('scheduled', 'en_route', 'completed', 'cancelled') DEFAULT 'scheduled',
    FOREIGN KEY (route_id) REFERENCES routes(route_id),
    FOREIGN KEY (number_plate) REFERENCES vehicles(number_plate),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT,
    client_name VARCHAR(100),
    client_phone VARCHAR(20),
    client_email VARCHAR(50),
    seat_number INT NOT NULL,
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status ENUM('pending', 'paid', 'refunded') DEFAULT 'pending',
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id)
);

CREATE TABLE parcels (
    parcel_id INT AUTO_INCREMENT PRIMARY KEY,
    sender_name VARCHAR(100),
    sender_phone VARCHAR(20),
    sender_email VARCHAR(50),
    receiver_name VARCHAR(100),
    receiver_phone VARCHAR(20),
    reciever_email VARCHAR(50),
    route_id INT,
    description TEXT,
    weight_kg DECIMAL(5, 2),
    price DECIMAL(10, 2),
    tracking_status ENUM('received', 'in_transit', 'delivered', 'collected') DEFAULT 'received',
    FOREIGN KEY (route_id) REFERENCES routes(route_id)
);

CREATE TABLE inquiries (
    inquiry_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inquirychats(
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    inquiry_id INT,
    message TEXT ,
    sender ENUM('client','admin') DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inquiry_id) REFERENCES inquiries(inquiry_id)
);

CREATE TABLE reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT,
    number_plate VARCHAR(20),
    driver_id INT,
    client_name VARCHAR(100),
    rating INT CHECK (rating BETWEEN 0 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(trip_id),
    FOREIGN KEY (number_plate) REFERENCES vehicles(number_plate),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

CREATE TABLE admin_users (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO admin_users(username,password_hash) VALUES ('ian','$2b$10$jdx8XyBl3Ph9rbr2NA/XCu0jJtrS9p1Prj8dsgWbTPShC2KuLGsLy');
