import { skills } from "services/skills";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const updateSkillTool = defineTool(
  "UpdateSkill",
  "Update an existing skill's name, description, and/or content.",
  z.object({
    name: z.string().describe("CamelCase name of the skill to update"),
    newName: z.string().nullable().describe("New human-readable name, or null to keep current"),
    newDescription: z.string().nullable().describe("New description, or null to keep current"),
    newContent: z.string().nullable().describe("New markdown content, or null to keep current"),
  }),
  async ({ name, newName, newDescription, newContent }) => {
    const skill = await skills.getByName(name);
    if (!skill) return { error: `Skill "${name}" not found` };

    await skills.update(skill.id, {
      name: newName ?? undefined,
      description: newDescription ?? undefined,
      content: newContent ?? undefined,
    });

    return { success: true, updated: name };
  },
);
