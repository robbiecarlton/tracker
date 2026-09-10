This is a spec for a new app.

The app will have a backend and a web frontend and an ios app frontend.

Please discuss with the user the best way to minimize duplication between a web frontend and ios app frontend. Are there better options than just a webview? Or is a webview normal practice these days?

# Purpose
The purpose of the app is to allow users to track multiple habits at once. There are several modes for tracking habits.

# Features
Simple, modern user auth. Users can create an account with email + password
Users can add multiple habits to track.

A Habit has
- a name
- a start date
- one or more Views
- (sometimes) streak unit
- (sometimes) cumulation goal
- (sometimes) percentage unit
- (sometimes) percentage target
- (sometimes) percentage target type
- (sometimes) days unit
- (sometimes) days target
- (sometimes) days target type
- a number of Logs. 

A Log has
- a timestamp
- (optionally) notes

### Habit Views
A Habit has one or more Views.
- Cumulative. Just tracks how many times total you've logged the habit since start date
- Percentage. You pick the unit (hour, day, week, month), and it tells you how many UNIT in a row you've logged this habbit
- Days. Like Percentage, but you specifiy a number of days (defaults to 7) and it tells you approximately (or specifically to 2 decimals per a setting) how many days out of N on average you're hitting
- Since. Pick a unit (hour, day, week, month), tracks UNIT's since you last logged.
- Streak. You pick the unit (hour, day, week, month), and it tells you how many UNIT in a row you've logged this habbit

Unit choice defaults to Day

You can change the view at any time.
You can have multiple views active simultaneously
Default is cumulative and Days out of 7.

You can log more than once per day, When you log there's a simple log: you just hit the log button. Or log with notes, where you can type in notes.
You can view all logs for a habit in a dedicated view, where you can also edit, add previous logs, delete logs etc.

You can change the start date of a habit. If you do, and you have logs prior to the new start date, the app will let you archive the current habit and start a new one with all the same config. So there's a place to view and edit archived habits, but they're moved from the main screen. If you don't archive, it just keeps the older logs in this habit, but in the log screen, the new start date (as well as all previous start dates) are kept, inline with the logs, and anything older than the current start date is visually distinguished as an archive log

Main screen is a dashboard of habits, showing the data for their views, with log buttons.

There's an add habit button that let's you create a new habit. 

You can also edit habits.

When you pick streak on the edit form, there's a warning that says "Be careful, tracking streaks has mixed benefits and can actually long term demotivate you. We suggest using cumulative and percentage or days instead"

Days and percentage have optional targets. If a target is given, you also specify is this target "at least" "at most" or "exactly". Meaning, does the user want to do better than the target (meditate more) or lower than the target (smoke less) or hit the target exactly (lift 3 times, no more no less).

The habit on the main page changes highlight color from green through orange to red, depending on if you're hitting or doing better than your target, or doing worse.



