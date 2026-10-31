export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }

      if (error?.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "A record with a conflicting unique value already exists.",
        });
      }

      if (error?.code === "P2003" || error?.code === "P2014") {
        return res.status(409).json({
          success: false,
          message: "The operation conflicts with related records.",
        });
      }

      if (error?.code === "P2025") {
        return res.status(404).json({
          success: false,
          message: "Record not found.",
        });
      }

      return next(error);
    }
  };
}

export function validateBody(req, res, { allowed, required = [], rules }) {
  if (
    req.body === null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    res.status(400).json({
      success: false,
      message: "Request body must be a JSON object.",
    });
    return null;
  }

  const keys = Object.keys(req.body);
  const unknownKey = keys.find((key) => !allowed.includes(key));
  if (unknownKey) {
    res.status(400).json({
      success: false,
      message: `Unknown request field: ${unknownKey}`,
    });
    return null;
  }

  const missingField = required.find(
    (field) => !Object.prototype.hasOwnProperty.call(req.body, field)
  );
  if (missingField) {
    res.status(400).json({
      success: false,
      message: `Missing required field: ${missingField}`,
    });
    return null;
  }

  const data = {};
  for (const key of keys) {
    const value = req.body[key];
    const rule = rules[key];

    if (rule === "string" || rule === "nonEmptyString") {
      if (
        typeof value !== "string" ||
        (rule === "nonEmptyString" && value.trim().length === 0)
      ) {
        res.status(400).json({
          success: false,
          message: `${key} must be ${rule === "string" ? "a string" : "a non-empty string"}.`,
        });
        return null;
      }

      data[key] = value;
      continue;
    }

    if (rule === "nullableString") {
      if (value !== null && typeof value !== "string") {
        res.status(400).json({
          success: false,
          message: `${key} must be a string or null.`,
        });
        return null;
      }

      data[key] = value;
      continue;
    }

    if (rule === "httpUrlOrNull") {
      if (value === null) {
        data[key] = null;
        continue;
      }

      if (typeof value !== "string") {
        res.status(400).json({
          success: false,
          message: `${key} must be an HTTP(S) URL or null.`,
        });
        return null;
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(value);
      } catch {
        res.status(400).json({
          success: false,
          message: `${key} must be an HTTP(S) URL or null.`,
        });
        return null;
      }

      if (
        !["http:", "https:"].includes(parsedUrl.protocol) ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        res.status(400).json({
          success: false,
          message: `${key} must be an HTTP(S) URL without embedded credentials.`,
        });
        return null;
      }

      data[key] = value;
      continue;
    }

    if (rule === "boolean") {
      if (typeof value !== "boolean") {
        res.status(400).json({
          success: false,
          message: `${key} must be a boolean.`,
        });
        return null;
      }

      data[key] = value;
      continue;
    }

    if (rule === "sortOrder") {
      if (!Number.isInteger(value) || value < 0 || value > 2147483647) {
        res.status(400).json({
          success: false,
          message: `${key} must be a non-negative 32-bit integer.`,
        });
        return null;
      }

      data[key] = value;
      continue;
    }

    if (
      rule === "jsonObject" &&
      (value === null || typeof value !== "object")
    ) {
      res.status(400).json({
        success: false,
        message: `${key} must be a JSON object or array.`,
      });
      return null;
    }

    data[key] = value;
  }

  return data;
}

export function validateId(req, res) {
  const { id } = req.params;
  if (typeof id !== "string" || id.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: "A non-empty record ID is required.",
    });
    return null;
  }

  return id;
}

export function validateQuery(req, res, allowed, parentField) {
  const queryKeys = Object.keys(req.query);
  const unknownKey = queryKeys.find((key) => !allowed.includes(key));
  if (unknownKey) {
    res.status(400).json({
      success: false,
      message: `Unknown query parameter: ${unknownKey}`,
    });
    return null;
  }

  if (!parentField || req.query[parentField] === undefined) {
    return {};
  }

  const parentId = req.query[parentField];
  if (typeof parentId !== "string" || parentId.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: `${parentField} must be a non-empty string.`,
    });
    return null;
  }

  return { [parentField]: parentId };
}

export function validateReorderBody(req, res, parentField) {
  const allowed = parentField ? [parentField, "items"] : ["items"];
  const required = parentField ? [parentField, "items"] : ["items"];
  const body = validateBody(req, res, {
    allowed,
    required,
    rules: parentField
      ? { [parentField]: "nonEmptyString" }
      : {},
  });
  if (!body) {
    return null;
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({
      success: false,
      message: "items must be a non-empty array.",
    });
    return null;
  }

  const items = [];
  const ids = new Set();
  const sortOrders = new Set();

  for (const item of body.items) {
    if (
      item === null ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).length !== 2 ||
      typeof item.id !== "string" ||
      item.id.trim().length === 0 ||
      !Number.isInteger(item.sortOrder) ||
      item.sortOrder < 0 ||
      item.sortOrder > 2147483647
    ) {
      res.status(400).json({
        success: false,
        message: "Each item must contain a non-empty id and non-negative 32-bit integer sortOrder.",
      });
      return null;
    }

    if (ids.has(item.id) || sortOrders.has(item.sortOrder)) {
      res.status(400).json({
        success: false,
        message: "Reorder items must have unique IDs and sortOrder values.",
      });
      return null;
    }

    ids.add(item.id);
    sortOrders.add(item.sortOrder);
    items.push({ id: item.id, sortOrder: item.sortOrder });
  }

  return {
    parentId: parentField ? body[parentField] : null,
    items,
  };
}

export async function reorderRecords(prisma, modelName, items, parentField) {
  return prisma.$transaction(async (transaction) => {
    const records = await transaction[modelName].findMany({
      where: { id: { in: items.map((item) => item.id) } },
      select: parentField
        ? { id: true, [parentField]: true }
        : { id: true },
    });

    if (records.length !== items.length) {
      throw new ApiError(404, "One or more records were not found.");
    }

    if (parentField) {
      const parentIds = new Set(records.map((record) => record[parentField]));
      if (parentIds.size !== 1) {
        throw new ApiError(
          400,
          "Reorder items must belong to the same parent."
        );
      }
    }

    await Promise.all(
      items.map((item) =>
        transaction[modelName].update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return items.length;
  });
}
