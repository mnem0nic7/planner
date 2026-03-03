import type { ChatCompletionTool } from "openai/resources/chat/completions.js";

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List all projects with their task counts, ordered by most recently created.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_project",
      description:
        "Get a single project by ID, including all its tasks and their tags.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "The ID of the project to retrieve.",
          },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Create a new project.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the project.",
          },
          description: {
            type: "string",
            description: "An optional description of the project.",
          },
          color: {
            type: "string",
            description:
              "An optional hex color code for the project (e.g. '#3b82f6').",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project",
      description: "Update an existing project's name, description, or color.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "The ID of the project to update.",
          },
          name: {
            type: "string",
            description: "The new name for the project.",
          },
          description: {
            type: "string",
            description: "The new description for the project.",
          },
          color: {
            type: "string",
            description: "The new hex color code for the project.",
          },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_project",
      description:
        "Delete a project and all its tasks. This action cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "The ID of the project to delete.",
          },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description:
        "List tasks with optional filters by project, completion status, priority, due date range, and sorting.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Filter tasks to a specific project.",
          },
          completed: {
            type: "boolean",
            description: "Filter by completion status (true or false).",
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
            description: "Filter by priority level.",
          },
          dueBefore: {
            type: "string",
            description: "Only include tasks due on or before this date (ISO 8601 format).",
          },
          dueAfter: {
            type: "string",
            description: "Only include tasks due on or after this date (ISO 8601 format).",
          },
          sortBy: {
            type: "string",
            enum: ["dueDate", "priority", "createdAt", "title"],
            description: "Field to sort by. Defaults to createdAt.",
          },
          sortOrder: {
            type: "string",
            enum: ["asc", "desc"],
            description: "Sort direction. Defaults to desc.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task in a project.",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "The ID of the project to add the task to.",
          },
          title: {
            type: "string",
            description: "The title of the task.",
          },
          description: {
            type: "string",
            description: "An optional description of the task.",
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
            description:
              "The priority level of the task. Defaults to MEDIUM if not specified.",
          },
          dueDate: {
            type: "string",
            description:
              "An optional due date in ISO 8601 format (e.g. '2025-03-15').",
          },
        },
        required: ["projectId", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description:
        "Update an existing task's title, description, priority, or due date.",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The ID of the task to update.",
          },
          title: {
            type: "string",
            description: "The new title for the task.",
          },
          description: {
            type: "string",
            description: "The new description for the task.",
          },
          priority: {
            type: "string",
            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
            description: "The new priority level for the task.",
          },
          dueDate: {
            type: "string",
            description:
              "The new due date in ISO 8601 format, or null to remove the due date.",
          },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description:
        "Toggle a task's completion status. If the task is incomplete, it will be marked complete and vice versa.",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The ID of the task to toggle completion for.",
          },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete a task. This action cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The ID of the task to delete.",
          },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tags",
      description: "List all available tags, ordered alphabetically by name.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_tag",
      description: "Create a new tag that can be applied to tasks.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the tag.",
          },
          color: {
            type: "string",
            description:
              "An optional hex color code for the tag (e.g. '#ef4444').",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_tag",
      description: "Update an existing tag's name or color.",
      parameters: {
        type: "object",
        properties: {
          tagId: {
            type: "string",
            description: "The ID of the tag to update.",
          },
          name: {
            type: "string",
            description: "The new name for the tag.",
          },
          color: {
            type: "string",
            description: "The new hex color code for the tag (e.g. '#ef4444').",
          },
        },
        required: ["tagId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_tag_to_task",
      description: "Add an existing tag to a task.",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The ID of the task to tag.",
          },
          tagId: {
            type: "string",
            description: "The ID of the tag to apply.",
          },
        },
        required: ["taskId", "tagId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_tag_from_task",
      description: "Remove a tag from a task.",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "The ID of the task to remove the tag from.",
          },
          tagId: {
            type: "string",
            description: "The ID of the tag to remove.",
          },
        },
        required: ["taskId", "tagId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_due_soon",
      description:
        "Get all incomplete tasks that are due within a given number of days (default 7).",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description:
              "Number of days to look ahead. Defaults to 7 if not specified.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_workload_summary",
      description:
        "Get an overview of the task workload including total, completed, pending, overdue counts and a breakdown by priority.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_complete_tasks",
      description: "Mark multiple tasks as completed or uncompleted at once.",
      parameters: {
        type: "object",
        properties: {
          taskIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of task IDs to update (max 50).",
          },
          completed: {
            type: "boolean",
            description: "Set to true to mark complete, false to mark incomplete.",
          },
        },
        required: ["taskIds", "completed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_delete_tasks",
      description: "Delete multiple tasks at once. This cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          taskIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of task IDs to delete (max 50).",
          },
        },
        required: ["taskIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_move_tasks",
      description: "Move multiple tasks to a different project.",
      parameters: {
        type: "object",
        properties: {
          taskIds: {
            type: "array",
            items: { type: "string" },
            description: "Array of task IDs to move (max 50).",
          },
          projectId: {
            type: "string",
            description: "The ID of the target project to move tasks to.",
          },
        },
        required: ["taskIds", "projectId"],
      },
    },
  },
];
