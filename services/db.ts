
import { QuestionEntry, Folder } from '../types';

const DB_NAME = 'PaperCutDB';
const DB_VERSION = 2; // Incremented for Folders
const STORE_QUESTIONS = 'questions';
const STORE_FOLDERS = 'folders';

// Helper to open DB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_QUESTIONS)) {
        const store = db.createObjectStore(STORE_QUESTIONS, { keyPath: 'id' });
        store.createIndex('year', 'year', { unique: false });
        store.createIndex('subject', 'subject', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
        const store = db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
        store.createIndex('subject', 'subject', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// --- Questions ---

export const saveQuestion = async (question: QuestionEntry): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_QUESTIONS);
    const request = store.put(question);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const bulkSaveQuestions = async (questions: QuestionEntry[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_QUESTIONS);
    
    if (questions.length === 0) resolve();

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();

    questions.forEach(q => store.put(q));
  });
};

export const getAllQuestions = async (): Promise<QuestionEntry[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readonly');
    const store = transaction.objectStore(STORE_QUESTIONS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as QuestionEntry[]);
    request.onerror = () => reject(request.error);
  });
};

export const getQuestionsBySubject = async (subject: string): Promise<QuestionEntry[]> => {
  const all = await getAllQuestions();
  return all.filter(q => q.subject === subject).sort((a, b) => b.createdAt - a.createdAt);
};

// NEW: Get questions to serve as AI training examples
export const getFewShotExamples = async (subject: string, limit: number = 5): Promise<QuestionEntry[]> => {
  const all = await getAllQuestions();
  // Filter for questions in the same subject that have both OCR text and Keywords
  const valid = all.filter(q => 
    q.subject === subject && 
    q.ocrText && 
    q.ocrText.length > 20 && 
    q.keywords.length > 0
  );
  // Shuffle and slice
  return valid.sort(() => 0.5 - Math.random()).slice(0, limit);
};

export const deleteQuestion = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_QUESTIONS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const updateQuestionStatus = async (id: string, status: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
        const store = transaction.objectStore(STORE_QUESTIONS);
        const getReq = store.get(id);
        
        getReq.onsuccess = () => {
            const question = getReq.result as QuestionEntry;
            if (question) {
                // @ts-ignore
                question.userStatus = status;
                store.put(question);
                resolve();
            } else {
                reject("Question not found");
            }
        };
        getReq.onerror = () => reject(getReq.error);
    });
};

export const updateQuestionMetadata = async (id: string, updates: { keywords?: string[], topics?: string[] }): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_QUESTIONS);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const question = getReq.result as QuestionEntry;
      if (question) {
        if (updates.keywords !== undefined) question.keywords = updates.keywords;
        if (updates.topics !== undefined) question.topics = updates.topics;
        store.put(question);
        resolve();
      } else {
        reject("Question not found");
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

export const bulkAddTopicToQuestions = async (ids: string[], topic: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS], 'readwrite');
    const store = transaction.objectStore(STORE_QUESTIONS);
    
    if (ids.length === 0) {
        resolve();
        return;
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    ids.forEach(id => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const q = getReq.result as QuestionEntry;
        if (q) {
          if (!q.topics.includes(topic)) {
            q.topics.push(topic);
            store.put(q);
          }
        }
      };
    });
  });
};

export const deleteSubjectData = async (subject: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_QUESTIONS, STORE_FOLDERS], 'readwrite');
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    // Delete questions for subject
    const qStore = transaction.objectStore(STORE_QUESTIONS);
    const qIndex = qStore.index('subject');
    const qReq = qIndex.openCursor(IDBKeyRange.only(subject));
    
    qReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
            cursor.delete();
            cursor.continue();
        }
    };

    // Delete folders for subject
    const fStore = transaction.objectStore(STORE_FOLDERS);
    const fIndex = fStore.index('subject');
    const fReq = fIndex.openCursor(IDBKeyRange.only(subject));
    
    fReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
            cursor.delete();
            cursor.continue();
        }
    };
  });
};

export const getAllUniqueKeywords = async (subject?: string): Promise<string[]> => {
  const qs = subject ? await getQuestionsBySubject(subject) : await getAllQuestions();
  const set = new Set<string>();
  qs.forEach(q => q.keywords.forEach(k => set.add(k)));
  return Array.from(set);
};

export const getAllUniqueTopics = async (subject?: string): Promise<string[]> => {
  const qs = subject ? await getQuestionsBySubject(subject) : await getAllQuestions();
  const set = new Set<string>();
  qs.forEach(q => q.topics.forEach(t => set.add(t)));
  return Array.from(set);
};

// --- Folders ---

export const saveFolder = async (folder: Folder): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORE_FOLDERS);
    const request = store.put(folder);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getFoldersBySubject = async (subject: string): Promise<Folder[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FOLDERS], 'readonly');
    const store = transaction.objectStore(STORE_FOLDERS);
    const index = store.index('subject');
    const request = index.getAll(subject);
    
    request.onsuccess = () => resolve(request.result as Folder[]);
    request.onerror = () => reject(request.error);
  });
};

export const deleteFolder = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_FOLDERS], 'readwrite');
    const store = transaction.objectStore(STORE_FOLDERS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
