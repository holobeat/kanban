Create a kanban app.

Tech stack:
===========
html5,
vanilla javascript,
IndexedDb storage for data and configuration

Functionality:
==============
Start with 3 categories: "To Do", "In Progress", and "Done".
More categories can be added or removed or edited.
Only category "In Progress" has setting "allow progress" on by default.
Then new task is created, allow the user to specify category.
Tasks can be added or removed or edited.
Task can have a deadline assigned to it.
When the task has deadline set, the progress in shown as a progress bar on the task's background, filling the vertical space of the task.
Task item can be edited by mouse click or tap on the item.
Task item can be dragged to another category. Dragging is activated by a long press.
Task can also be dragged to another position within the same category.
Clicking a category name shows a modal dialog, that lets the user setup the following:
  - category background color,
  - caption,
  - "allow progress" setting.


Layout:
=======
Responsive design.
On desktop, each category is in its own column.
On mobile, categories are in tabs, so only one category is shown at a time.
Category container has rounded corners.
Category container fills available vertical space.
Dialogs have rounded corners.
Top of the page has Kanban name on it, centered. Aligned right is the settings icon (gear), that lets the user do the following:
  - name of the kanban caption
  - export kanban data to a file (download)
  - import saved data file back to the app (upload kanban)
  - remove all tasks and reset the app to the default settings


Default colors:
===============
Frame around kanban is leather brown, and there is leather brown gap between the categories columns.
Category background color is low saturation yellow, like a paper notepad.
Tasks are separated by 2px low saturation blue color, like a paper notepad.
Color of the task progrees bar is semi transparent red.
