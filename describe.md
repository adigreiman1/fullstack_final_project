# Product Specification Document

## What problem does the product solve?
Currently, planning work routes for field service vehicles is mostly done manually and in a decentralized manner[cite: 2]. Service dispatchers have to zigzag between dry data in the organizational SAP system and free auxiliary tools like Google Calendars and Google Maps to try and piece together a situational picture[cite: 2]. This working method creates several critical problems:
* Wasting valuable time of the dispatch team on routine planning[cite: 2].
* Building inefficient routes that lead to double trips, overlapping sectors, and wasted fuel[cite: 2].
* Difficulty in making quick real-time decisions due to the lack of a unified geographical situational picture[cite: 2].

## Who are the users of the product?
The users are service dispatchers, operations managers, and field service providers[cite: 2]. These users are responsible for the ongoing management of service vehicles, distributing workloads across different sectors, and monitoring that tasks are performed within the promised time windows[cite: 2].

## Who is the client?
Medium-to-large organizations or companies providing field services (such as telecommunication companies, maintenance, field technicians, complex deliveries), which already manage their core business through an SAP system but need a smart, efficient, and lightweight display layer[cite: 2].

## What are the business goals of the product?
The product is designed to allow the organization to work more efficiently[cite: 2]. The main goals are: 
* **Save time:** Significant reduction in the time a service dispatcher spends on daily planning[cite: 2]. 
* **Prevent synchronization issues and human errors:** Eliminating the need to work and zigzag in parallel between the SAP system and external calendars, which prevents information gaps, duplications, and missed service calls due to lack of synchronization[cite: 2].
* **Economic efficiency:** Reducing fuel costs and wear and tear on service vehicles by shortening travel routes[cite: 2].
* **Increase productivity:** Optimization will allow each service vehicle to complete more tasks in a given workday[cite: 2].
* **Improve service:** Better adherence to the time windows promised to end customers[cite: 2].

## What are the main processes the product allows users to perform?
To achieve the business goals, these are the main processes in the system:
* **Registration and Login:** Secure access to the dashboard (only authorized employees can access organizational information)[cite: 2]. 
* **Visualization of tasks by sectors:** Displaying all service tasks derived from SAP on a central map, filtered by regions (e.g., Center, Sharon, etc.), to understand the deployment of forces[cite: 2].
* **Receiving recommendations for smart routing:** The system investigates the list of destination addresses for each service vehicle and displays the optimal travel route on the map (connecting the points to a route)[cite: 2]. 
* **Quick details display:** Clicking on a destination point (marker) opens a concise information window with the vehicle assignment and a short operational note, without needing to leave the map and return to SAP[cite: 2].

---

# Software Architecture Planning

## Core System Components
The system is built in a modern Web architecture based on Next.js (App Router), divided into three main layers[cite: 2]:
* **Frontend (Client-side):** The user interface (UI) that builds the interactive dashboard, the map (using React-based libraries), and the creation of visual routes[cite: 2].
* **Backend (Server-side):** Managed by Next.js (Server Actions and API Routes) whose role is to authenticate users, fetch data securely, and mediate requests with external services[cite: 2].
* **Database:** Storing raw data and managing user permissions[cite: 2].

## Database and Tables
The system will use Supabase as the relational database (PostgreSQL)[cite: 2].
Main entities (tables):
* **Tasks table (`service_tasks`):** Will store the information "drawn" from SAP: task ID, address, coordinates (lat/lng), time window for execution, vehicle ID (`vehicle_id`), status, and a short note[cite: 2].
* **Users table (`users/profiles`):** Will be managed by Supabase's Auth system to define authorized users (service dispatchers)[cite: 2].

## Application Pages (Pages)
The system is essentially a Single Page Application (SPA), under the wrapper of a dashboard, and will include[cite: 2]:
* **Login Page (`Login`):** Secure authentication for organizational employees[cite: 2].
* **Main Dashboard Page (`Main Dashboard`):** The home page that will include the full task map, filtering by regions, and displaying the optimal routing path for each vehicle[cite: 2].

## Data Flow
**How will the information flow between the Frontend and Backend?**
1. The end-user (dispatcher) opens the dashboard in the browser[cite: 2].
2. The Frontend calls the Next.js Server Actions[cite: 2].
3. The Server Action contacts Supabase, fetches the daily task list of all vehicles, and returns them to the client[cite: 2].
4. The Frontend passes the task coordinates to the Mapbox API[cite: 2].
5. Mapbox returns the optimal route, and the Frontend draws it on the map[cite: 2].

## External Services and Libraries
* **Mapbox GL JS / react-map-gl:** Libraries for rendering the interactive map on the client-side and displaying markers[cite: 2].
* **Mapbox Optimization API:** An external service for obtaining the most efficient navigation route (Routing) between several waypoints for a service vehicle[cite: 2]. Chosen for its ability to handle multi-destination optimization (TSP - Traveling Salesperson Problem)[cite: 2].
* **Tailwind CSS:** For fast, responsive, and clean design of the dashboard without writing separate CSS files[cite: 2].
* **Supabase Auth:** For fast and secure management of access permissions, as required for an organizational system[cite: 2].

---

# Detailed Technical Planning

## Project Folder Structure
The project will be based on Next.js App Router and divided into the following folders[cite: 2]:
* **`src/app/`:** Will contain the main routes (`page.tsx` for the main dashboard, `layout.tsx` for the wrapper) and the API Routes (`api/`)[cite: 2].
* **`src/components/`:** Will contain UI components (buttons, cards) and map components (`MapDashboard.tsx`, `MarkerTooltip.tsx`)[cite: 2].
* **`src/actions/`:** Will contain the Next.js Server Actions for secure data fetching[cite: 2].
* **`src/lib/`:** Configuration settings (e.g., `supabase.ts` for client initialization) and utility functions (`utils.ts`)[cite: 2].
* **`src/types/`:** TypeScript interfaces and data schemas[cite: 2].

## Core Components Structure
* **`DashboardLayout`:** Wraps the application with a top navigation menu[cite: 2].
* **`MapDashboard`:** The main Client component that manages the map (via `react-map-gl`)[cite: 2].
* **`RouteLayer`:** A component responsible for drawing the polygons (connecting lines) of the travel routes on the map[cite: 2].
* **`TaskTooltip`:** Displays the task details (vehicle and note) when clicking on a marker on the map[cite: 2].

## Database Structure
We use one central table in Supabase called `service_tasks` including the following fields[cite: 2]:
* `id` (UUID, Primary Key)[cite: 2]
* `address` (Text)[cite: 2]
* `lat`, `lng` (Double Precision) - Coordinates[cite: 2].
* `time_window` (Text) - E.g., "08:00-10:00"[cite: 2].
* `vehicle_id` (Text) - Service vehicle ID[cite: 2].
* `status` (Text) - Task status (PENDING, COMPLETED)[cite: 2].
* `short_note` (Text) - Short operational note[cite: 2].

## Core CREATE/READ/UPDATE/DELETE Operations and API Description
Since the system is defined as Read-Only over SAP, the main operation is READ[cite: 2].
* **Server Action - `getDailyTasks()`:** Fetching all tasks for that day from Supabase, filtering them by relevant statuses, and returning them to the client[cite: 2].
* **External API - Mapbox Optimization API:** A GET request to the Mapbox API that sends an array of coordinates and receives back the geometry of the optimal route (GeoJSON)[cite: 2].

## Core Business Logic Description
1. The system loads the daily tasks from the DB (via the Server Action)[cite: 2].
2. The data is grouped on the client-side by `vehicle_id`[cite: 2].
3. For each group of tasks of a specific vehicle, the system sends a request to the Mapbox Optimization API[cite: 2].
4. The API calculates the shortest and most efficient route (solving the Traveling Salesperson Problem - TSP) and returns the correct order and geographical path[cite: 2].
5. The system draws the routes on the map, with each vehicle receiving its own unique color for clear visual separation[cite: 2].

## State Management in the Application
* **Server State:** Managed by Next.js (fetching data in the Server Component and passing it as Props)[cite: 2].
* **Client State:** Managed using React `useState` (e.g., saving the currently selected task to display a Tooltip, or saving the camera/zoom position on the map)[cite: 2]. Using `useMemo` to prevent unnecessary re-rendering of Mapbox routes during minor State changes[cite: 2].

## Error Handling and Input Validation
* **Network Errors:** If the Mapbox API crashes or exceeds the Rate Limit, the system will fallback and display only the markers without the route lines, while displaying an appropriate error message (Toast) to the dispatcher[cite: 2].
* **Internal Validations:** Using the Zod library to ensure the data returning from Supabase matches the schema (e.g., that `lat`/`lng` are valid numbers and that `short_note` does not exceed the word limit)[cite: 2].

## Core User Experience Planning
The emphasis is on a clean interface that does not cognitively overload the service dispatcher[cite: 2]:
* Using different colors for routes of different vehicles[cite: 2].
* Clear markers that are clickable to get immediate information, without moving to another page[cite: 2].
* A loading display (Loading Spinner or Skeleton) while Mapbox calculates the routes, to give visual feedback to the user that the system is working[cite: 2].