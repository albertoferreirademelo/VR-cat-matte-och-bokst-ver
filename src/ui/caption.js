// A story question's text as a caption at the bottom of the page, for flat screens too small to
// read the story board in the scene (a phone; when it shows is decided in style.css). In a
// headset the page is not seen, so there the board is all there is.
let element = null;

export function showCaption(sentences) {
  if (typeof document === 'undefined') return;
  if (!element) {
    element = document.createElement('div');
    element.id = 'caption';
    document.body.append(element);
  }
  element.replaceChildren(
    ...sentences.map((sentence) => {
      const line = document.createElement('p');
      // The numbers stand out, as on the board.
      for (const [i, word] of sentence.split(' ').entries()) {
        if (i) line.append(' ');
        if (/\d/.test(word)) line.append(Object.assign(document.createElement('b'), { textContent: word }));
        else line.append(word);
      }
      return line;
    }),
  );
  element.hidden = false;
}

export function hideCaption() {
  if (element) element.hidden = true;
}
