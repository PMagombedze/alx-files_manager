import { writeFile } from 'fs';
import { promisify } from 'util';
import Queue from 'bull/lib/queue';
import imgThumbnail from 'image-thumbnail';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from './utils/db';
import Mailer from './utils/mailer';

const writeFileAsync = promisify(writeFile);

const fileQueue = new Queue('thumbnail generation');
const userQueue = new Queue('email sending');


const generateThumbnail = async (filePath, size) => {
  const buffer = await imgThumbnail(filePath, { width: size });
  console.log(`Generating file: ${filePath}, size: ${size}`);
  return writeFileAsync(`${filePath}_${size}`, buffer);
};


fileQueue.process(async (job, done) => {
  const fileId = job.data.fileId || null;
  const userId = job.data.userId || null;

  if (!fileId || !userId) {
    throw new Error('Missing fileId or userId');
  }

  console.log('Processing', job.data.name || '');

  const file = await (await dbClient.filesCollection())
    .findOne({
      _id: new mongoDBCore.BSON.ObjectId(fileId),
      userId: new mongoDBCore.BSON.ObjectId(userId),
    });

  if (!file) {
    throw new Error('File not found');
  }

  const sizes = [500, 250, 100];
  await Promise.all(sizes.map((size) => generateThumbnail(file.localPath, size)));
  done();
});

userQueue.process(async (job, done) => {
  const userId = job.data.userId || null;

  if (!userId) {
    throw new Error('Missing userId');
  }

  const user = await (await dbClient.usersCollection())
    .findOne({ _id: new mongoDBCore.BSON.ObjectId(userId) });

  if (!user) {
    throw new Error('User not found');
  }

  console.log(`Welcome ${user.email}!`);

  const mailSubject = 'Welcome to ALX-Files_Manager by B3zaleel';
  const mailContent = [
    '<div>',
    `<h3>Hello ${user.name},</h3>`,
    `Welcome to <a href="https://github.com/B3zaleel/alx-files_manager">ALX-Files_Manager</a>!`,
    '</div>',
  ].join('');

  done();
});
